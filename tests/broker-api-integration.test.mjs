import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost} from '../site1-dark-gradient/functions/api/update.js';
import {onRequestGet} from '../site1-dark-gradient/functions/api/brokers.js';
import {onRequest as admin} from '../site1-dark-gradient/functions/api/admin/[[path]].js';

const key='a'.repeat(40);
function fakeDB(){
 const brokers=new Map(), events=[];
 return {
  brokers,events,
  prepare(sql){
   let args=[];
   const stmt={
    bind(...values){args=values;return stmt},
    async first(){if(sql.startsWith('SELECT data FROM brokers')){const data=brokers.get(args[0]);return data?{data}:null}throw Error('unexpected query')},
    async all(){
     if(sql.startsWith('SELECT data FROM brokers'))return {results:[...brokers].sort(([a],[b])=>a.localeCompare(b)).map(([,data])=>({data}))};
     if(sql.startsWith('SELECT kind AS type'))return {results:events.filter(e=>e.created_at>args[0]).map(e=>({type:e.kind,payload:e.payload,timestamp:e.created_at}))};
     throw Error('unexpected query')
    },
    execute(){
     if(sql.startsWith('INSERT INTO brokers'))brokers.set(args[0],args[1]);
     else if(sql.startsWith('DELETE FROM brokers'))brokers.delete(args[0]);
     else if(sql.startsWith('INSERT INTO broker_events'))events.push({kind:args[0],payload:args[2],created_at:args[5]});
     else throw Error('unexpected SQL')
    }
   };
   return stmt;
  },
  async batch(statements){for(const s of statements)s.execute()}
 };
}
function post(env,type,payload,withKey=true){
 return onRequestPost({env,request:new Request('https://example.com/api/update',{method:'POST',headers:{'Content-Type':'application/json',...(withKey?{'X-API-Key':key}:{})},body:JSON.stringify({type,payload})})});
}
test('broker write, update, read and delete work against a D1-compatible stub',async()=>{
 const db=fakeDB(),env={BROKERS_DB:db,BROKER_ADMIN_API_KEY:key};
 let res=await post(env,'new_broker',{id:'alpha',name:'Alpha',rating:4.1});
 assert.equal(res.status,200);
 res=await post(env,'broker_update',{id:'alpha',name:'Alpha Prime'});
 assert.equal(res.status,200);
 res=await onRequestGet({env,request:new Request('https://example.com/api/brokers')});
 assert.equal(res.status,200);
 let data=await res.json();
 assert.equal(data.brokers[0].name,'Alpha Prime');
 assert.equal(data.brokers[0].rating,4.1);
 assert.equal(db.events.length,2);
 res=await post(env,'delete_broker',{id:'alpha'});
 assert.equal(res.status,200);
 assert.equal(db.brokers.size,0);
 assert.equal(db.events.length,3);
});
test('invalid updates return 400 and cannot modify data',async()=>{
 const db=fakeDB(),env={BROKERS_DB:db,BROKER_ADMIN_API_KEY:key};
 await post(env,'new_broker',{id:'alpha',name:'Alpha'});
 const bad=await post(env,'broker_update',{id:'alpha',name:'Valid',rating:8});
 assert.equal(bad.status,400);
 const unknown=await post(env,'broker_update',{id:'alpha',role:'admin'});
 assert.equal(unknown.status,400);
 assert.equal(db.events.length,1);
});
test('admin endpoints fail closed with no Access configuration',async()=>{
 const env={BROKERS_DB:fakeDB(),BROKER_ADMIN_API_KEY:key};
 const res=await admin({env,request:new Request('https://example.com/api/admin/brokers')});
 assert.equal(res.status,401);
});
