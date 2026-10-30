import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
export function database(){
  const sql=new DatabaseSync(':memory:');
  const directory=new URL('../migrations/',import.meta.url);
  for(const file of readdirSync(directory).filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(new URL(file,directory),'utf8'));
  return {sql,db:{prepare(query){return{bind(...args){return statement(query,args);},...statement(query,[])};}}};
  function statement(query,args){return{async run(){return sql.prepare(query).run(...args);},async first(){return sql.prepare(query).get(...args)??null;},async all(){return {results:sql.prepare(query).all(...args)};}};}
}
