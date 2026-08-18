import { apiRequest } from './apiClient';

export type Notice = { noticeId:number; title:string; content:string; pinned:boolean; visible:boolean; authorName:string; publishedAt:string|null; updatedAt:string };
export type NoticeRequest = Pick<Notice, 'title'|'content'|'pinned'|'visible'>;
export async function getNotices(){ return (await apiRequest<Notice[]>('/api/notices',{method:'GET',skipAuth:true})) ?? []; }
export async function getAdminNotices(){ return (await apiRequest<Notice[]>('/api/admin/notices',{method:'GET'})) ?? []; }
export function createAdminNotice(request:NoticeRequest){ return apiRequest<Notice>('/api/admin/notices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)}); }
export function updateAdminNotice(id:number,request:NoticeRequest){ return apiRequest<Notice>(`/api/admin/notices/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)}); }
export function deleteAdminNotice(id:number){ return apiRequest<null>(`/api/admin/notices/${id}`,{method:'DELETE'}); }
