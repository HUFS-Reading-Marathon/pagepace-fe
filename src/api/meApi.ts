import { apiRequest } from './apiClient';import type { AuthUser } from '../auth/authTypes';
export type MeUpdateRequest={name:string;email:string;phone:string;affiliationType:string;department:string};
export function getMe(){return apiRequest<AuthUser>('/api/me',{method:'GET'})}
export function updateMe(request:MeUpdateRequest){return apiRequest<AuthUser>('/api/me',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)})}
export function changeMyPassword(currentPassword:string,newPassword:string){return apiRequest<null>('/api/me/password',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword,newPassword})})}
