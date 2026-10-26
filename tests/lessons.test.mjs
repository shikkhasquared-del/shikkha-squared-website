import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';

const output=path.resolve('.test-output/lessons'),outputUrl=pathToFileURL(output).href;
await fs.mkdir(output,{recursive:true});
await fs.writeFile(output+'/lessons.mjs',ts.transpileModule(await fs.readFile('lib/lessons.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
const L=await import(outputUrl+'/lessons.mjs');
const master='https://g28gh6aqk9.tenbytecdn.com/19c10812-7040-42ec-9463-9aea44cd6c0a/playlist.m3u8';

test('Only HTTPS HLS playlists on allowed CDN hosts are streamed',()=>{
  assert.deepEqual(L.videoSource(master),{origin:'https://g28gh6aqk9.tenbytecdn.com',rootPath:'/19c10812-7040-42ec-9463-9aea44cd6c0a/',masterPath:'/19c10812-7040-42ec-9463-9aea44cd6c0a/playlist.m3u8'});
  for(const bad of ['http://g28gh6aqk9.tenbytecdn.com/a/playlist.m3u8','https://evil.test/a/playlist.m3u8','https://tenbytecdn.com.evil.test/a/p.m3u8','https://g28gh6aqk9.tenbytecdn.com/a/video.mp4','https://user:pw@x.tenbytecdn.com/a/p.m3u8','not a url'])assert.equal(L.videoSource(bad),null,bad);
  assert.ok(L.videoSource('https://videos.example.org/a/p.m3u8',['videos.example.org']));
});

test("Students can only request files inside the lesson's own video folder",()=>{
  const s=L.videoSource(master);
  assert.equal(L.mediaPath(s,''),s.masterPath);
  assert.equal(L.mediaPath(s,'playlist.m3u8'),s.rootPath+'playlist.m3u8');
  assert.equal(L.mediaPath(s,'360p/video.m3u8'),s.rootPath+'360p/video.m3u8');
  assert.equal(L.mediaPath(s,'360p/video0.ts'),s.rootPath+'360p/video0.ts');
  for(const bad of ['../other/playlist.m3u8','360p/../../x.m3u8','/abs.m3u8','a//b.m3u8','%2e%2e/x.m3u8','360p/video.m3u8?x=1','360p/video0.ts/','index.html','360p/video0'])assert.equal(L.mediaPath(s,bad),null,bad);
  assert.equal(L.isPlaylist(s.rootPath+'360p/video.m3u8'),true);
  assert.equal(L.isPlaylist(s.rootPath+'360p/video0.ts'),false);
});

test('Playlists are rewritten so every playlist and video piece comes through the site',()=>{
  const s=L.videoSource(master);
  const masterText='#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=644464,RESOLUTION=640x360\n360p/video.m3u8\n#EXT-X-MEDIA:TYPE=AUDIO,URI="audio/en.m3u8"\n';
  const out=L.rewritePlaylist(masterText,s.masterPath,s,'/learn/physics/stream/0/');
  assert.match(out,/^\/learn\/physics\/stream\/0\/360p\/video\.m3u8$/m);
  assert.match(out,/URI="\/learn\/physics\/stream\/0\/audio\/en\.m3u8"/);
  const variant='#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXTINF:4.0,\nvideo0.ts\n#EXTINF:4.0,\nvideo1.ts\n#EXT-X-ENDLIST\n';
  const v=L.rewritePlaylist(variant,s.rootPath+'360p/video.m3u8',s,'/learn/physics/stream/0/');
  const lines=v.split('\n');
  assert.equal(lines[4],'/learn/physics/stream/0/360p/video0.ts');
  assert.equal(lines[2],'#EXT-X-KEY:METHOD=AES-128,URI="/learn/physics/stream/0/360p/key.bin"');
  assert.equal(lines.filter(l=>l.startsWith('#')).length,6,'tags are kept');
  assert.equal((out+v).includes('tenbytecdn.com'),false,"Tenbyte's address never reaches the browser");
  const outside=L.rewritePlaylist('#EXTM3U\nhttps://other.test/x.ts\n/elsewhere/y.ts\n',s.masterPath,s,'/p/');
  assert.match(outside,/^https:\/\/other\.test\/x\.ts$/m);
  assert.match(outside,/^\/elsewhere\/y\.ts$/m,'files outside the lesson folder are not proxied');
});

test('Free previews open for everyone; other lessons only for enrolled students',()=>{
  const lessons=L.courseLessons({lessons:[{title:'Intro',kind:'video',resourceUrl:master,free:true},{title:'Paid',kind:'video',resourceUrl:master}]});
  assert.equal(L.canOpen(lessons[0],false),true);
  assert.equal(L.canOpen(lessons[1],false),false);
  assert.equal(L.canOpen(lessons[1],true),true);
  assert.equal(L.canOpen(undefined,true),false);
  assert.deepEqual(L.courseLessons({}),[]);
});
