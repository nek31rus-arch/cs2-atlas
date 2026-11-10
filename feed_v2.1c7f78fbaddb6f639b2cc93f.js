/* Pure atlas_feed_v2 contract. No I/O, clocks, SQL, or production authority. */
(function(root){
'use strict';
const CORE=Object.freeze(['Market.CSGO','LIS-SKINS','CS.MONEY Market']), REFERENCE='CSFloat', LIMIT=200;
function sequence(v){if(typeof v!=='string'||! /^(0|[1-9][0-9]*)$/.test(v))throw Error('invalid_sequence');return v;}
function seqCmp(a,b){sequence(a);sequence(b);return a.length-b.length||(a<b?-1:a>b?1:0);}
function cmp(a,b){return seqCmp(a.ingestion_sequence,b.ingestion_sequence)||(a.observation_id<b.observation_id?-1:a.observation_id>b.observation_id?1:0);}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
function valid(row,venue,watermark){
 if(!row||row.venue!==venue||typeof row.observation_id!=='string'||!row.observation_id)throw Error('invalid_identity');
 if(typeof row.instrument!=='string'||!row.instrument||!['listing_id','asset_id','variant','wear','float','seed','price','currency','price_kind','source_at','received_at','projection_at','link'].every(k=>Object.hasOwn(row,k)))throw Error('missing_row_fields');
 sequence(row.ingestion_sequence);if(seqCmp(row.ingestion_sequence,watermark)>0)throw Error('row_after_watermark');
 return row;
}
function select(rows,venue,watermark){
 const unique=new Map();for(const row of rows){valid(row,venue,watermark);const old=unique.get(row.observation_id);if(old&&JSON.stringify(canonical(old))!==JSON.stringify(canonical(row)))throw Error('conflicting_observation');unique.set(row.observation_id,row);}
 return [...unique.values()].sort((a,b)=>-cmp(a,b)).slice(0,LIMIT);
}
function venues(reference){return reference?[...CORE,REFERENCE]:[...CORE];}
function cursor(row,epoch){return row?{epoch,sequence:row.ingestion_sequence,observation_id:row.observation_id}:null;}
// Fixture/reference selector only; A supplies bounded per-venue indexed production reads.
function snapshot(input,{watermark,epoch,status={},reference=false,cursors={}}){
 sequence(watermark);if(typeof epoch!=='string'||!epoch)throw Error('missing_epoch');
 const enabled=venues(reference),per_venue={},rows=[],has_more_by_venue={};
 for(const venue of enabled){
  const s=status[venue]||{state:'unknown',error:'venue_not_reported'};
  if(!['complete','incomplete','unknown','error'].includes(s.state))throw Error('invalid_status');
  const selected=['unknown','error'].includes(s.state)?[]:select(input.filter(r=>r.venue===venue&&seqCmp(r.ingestion_sequence,watermark)<=0),venue,watermark);
  const old=cursors[venue];let reset_reason=null;
  if(old){if(old.epoch!==epoch)reset_reason='epoch_changed';else if(!selected.length||seqCmp(sequence(old.sequence),selected[0].ingestion_sequence)>0)reset_reason='cursor_ahead';else if(seqCmp(old.sequence,selected[selected.length-1].ingestion_sequence)<0)reset_reason='cursor_expired';}
  rows.push(...selected);has_more_by_venue[venue]=false;
  per_venue[venue]={mode:'snapshot',cursor:cursor(selected[0],epoch),count:selected.length,latest_received_at:selected[0]?.received_at??null,oldest_retained_at:selected.at(-1)?.received_at??null,complete:s.state==='complete',error:s.error??null,state:s.state,reset_reason};
 }
 return {schema_rev:'atlas_feed_v2',snapshot_watermark:watermark,epoch,enabled_venues:enabled,per_venue,rows:rows.sort((a,b)=>-cmp(a,b)||(a.venue<b.venue?-1:1)),has_more_by_venue,read_only:true,priority_executor_connected:false,source_coverage_verified:false};
}
class Store{
 constructor(){this.byVenue=new Map();this.meta=new Map();this.watermark='0';this.epoch=null;this.enabled=[...CORE,REFERENCE];}
 apply(packet){
  if(packet.schema_rev!=='atlas_feed_v2')throw Error('unsupported_schema');sequence(packet.snapshot_watermark);
  const enabled=packet.enabled_venues;if(!Array.isArray(enabled)||JSON.stringify(enabled)!==JSON.stringify(venues(enabled.includes(REFERENCE))))throw Error('invalid_enabled_venues');
  if(typeof packet.epoch!=='string'||!packet.epoch)throw Error('missing_epoch');
  if(packet.epoch===this.epoch&&seqCmp(packet.snapshot_watermark,this.watermark)<0)throw Error('stale_snapshot');
  if(!Array.isArray(packet.rows)||packet.rows.length>enabled.length*LIMIT||packet.rows.some(r=>!enabled.includes(r.venue)))throw Error('invalid_rows');
  const epochChanged=this.epoch!==packet.epoch, next=new Map(epochChanged?[]:this.byVenue),meta=new Map();
  // Validate all venues before committing any state. A bad venue cannot partly advance cursors.
  for(const venue of enabled){
   const m=packet.per_venue?.[venue];if(!m||!['complete','incomplete','error','unknown'].includes(m.state)||!['snapshot','delta'].includes(m.mode)||typeof packet.has_more_by_venue?.[venue]!=='boolean'||m.complete!==(m.state==='complete'))throw Error('invalid_metadata');
   const incoming=packet.rows.filter(r=>r.venue===venue);if(incoming.length>LIMIT)throw Error('venue_over_quota');
   const selected=select(incoming,venue,packet.snapshot_watermark);if(selected.length!==incoming.length)throw Error('duplicate_packet_identity');
   if(m.count!==selected.length)throw Error('count_mismatch');
   if(['error','unknown'].includes(m.state)){
    if(incoming.length)throw Error('error_has_rows');
    meta.set(venue,{...m,cursor:epochChanged?null:this.meta.get(venue)?.cursor??null,retained_stale:(next.get(venue)||[]).length>0});continue;
   }
   if(m.mode==='delta'&&(epochChanged||!this.meta.has(venue)))throw Error('snapshot_required');
   if(m.cursor!==null){if(!m.cursor||m.cursor.epoch!==packet.epoch||typeof m.cursor.observation_id!=='string')throw Error('invalid_cursor');sequence(m.cursor.sequence);if(seqCmp(m.cursor.sequence,packet.snapshot_watermark)>0)throw Error('cursor_after_watermark');}
   if(selected.length&&(!m.cursor||m.cursor.sequence!==selected[0].ingestion_sequence||m.cursor.observation_id!==selected[0].observation_id))throw Error('cursor_identity_mismatch');
   if(m.mode==='snapshot'&&!selected.length&&m.cursor!==null)throw Error('empty_snapshot_cursor');
   const prior=next.get(venue)||[];
   // A replacement snapshot still replays immutable IDs from the retained window.
   // Compare overlap before replacing it; all changes remain local until full commit.
   const merged=select([...prior,...selected],venue,packet.snapshot_watermark);
   const oldCursor=this.meta.get(venue)?.cursor;
   if(m.mode==='delta'&&oldCursor&&(!m.cursor||seqCmp(m.cursor.sequence,oldCursor.sequence)<0||(m.cursor.sequence===oldCursor.sequence&&m.cursor.observation_id<oldCursor.observation_id)))throw Error('cursor_regression');
   next.set(venue,(m.mode==='snapshot'?selected:merged).map(canonical));meta.set(venue,{...m,retained_stale:false});
  }
  this.enabled=enabled.slice();this.byVenue=new Map([...next].filter(([v])=>enabled.includes(v)));this.meta=meta;this.epoch=packet.epoch;this.watermark=packet.snapshot_watermark;return this.rows();
 }
 rows(){return [...this.byVenue.values()].flat().sort((a,b)=>-cmp(a,b)||(a.venue<b.venue?-1:1));}
 cursors(){return Object.fromEntries(this.enabled.map(v=>[v,this.meta.get(v)?.cursor??null]));}
 summary(){return this.enabled.map(venue=>({venue,...this.meta.get(venue),count:(this.byVenue.get(venue)||[]).length}));}
}
root.AtlasFeedV2=Object.freeze({CORE,REFERENCE,LIMIT,sequence,seqCmp,cmp,select,snapshot,Store});
})(typeof module==='object'?module.exports:window);
