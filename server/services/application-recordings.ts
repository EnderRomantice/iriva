import {recordingMaxBytes, recordingMaxSeconds, type OralRecording} from '../../lib/oral-recording';
import type {DatabaseRepository} from '../repositories/database-repository';

export function parseRecording(value: unknown): OralRecording | null {
 if (!value || typeof value !== 'object') return null;
 const {data,type,duration}=value as OralRecording;
 if(typeof data!=='string'||data.length>Math.ceil(recordingMaxBytes/3)*4||!data.length||typeof type!=='string'||!['audio/webm','audio/mp4','audio/ogg'].includes(type)||!Number.isInteger(duration)||duration<1||duration>recordingMaxSeconds||data.length%4!==0)return null;
 const bytes=Buffer.from(data,'base64');
 if(bytes.length<12||bytes.length>recordingMaxBytes||bytes.toString('base64')!==data)return null;
 const signature=type==='audio/webm'?bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])):type==='audio/mp4'?bytes.toString('ascii',4,8)==='ftyp':bytes.toString('ascii',0,4)==='OggS';
 return signature?{data,type,duration}:null;
}
/** Caller runs this in the same transaction as the application save. */
export async function saveRecording(repo:DatabaseRepository,id:string,recording:OralRecording,now:string){
 await repo.db.prepare('INSERT INTO application_recordings (application_id,data_base64,mime_type,duration,updated) VALUES (?,?,?,?,?) ON CONFLICT(application_id) DO UPDATE SET data_base64=excluded.data_base64,mime_type=excluded.mime_type,duration=excluded.duration,updated=excluded.updated').run(id,recording.data,recording.type,recording.duration,now);
 await repo.db.prepare("UPDATE member_applications SET recording_updated=?,oral_score=NULL,oral_level='',oral_notes='',oral_reviewed_at='',oral_reviewer='' WHERE id=?").run(now,id);
}
