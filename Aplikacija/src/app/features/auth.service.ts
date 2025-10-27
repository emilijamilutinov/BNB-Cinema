import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private base = 'http://localhost:4000/api';
  private isBrowser = false;

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  signup(body: { username: string; email: string; password: string }): Observable<any> {
    return this.http.post(`${this.base}/auth/signup`, body);
  }

  login(body: { email: string; password: string }): Observable<{ token: string; user?: any }> {
    return this.http.post<{ token: string; user?: any }>(`${this.base}/auth/login`, body);
  }

  updateUser(body: { email: string; username?: string; password?: string }): Observable<any> {
    return this.http.patch(
      `${this.base}/users/update`,
      body,
      { headers: this.buildAuthHeaders() }   // ⬅️ uvijek HttpHeaders
    );
  }

  private getToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem('token');
  }

  private buildAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    // Ako token ne postoji, vrati prazan HttpHeaders
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  logout() {
    if (this.isBrowser) localStorage.removeItem('token');
  }
}
