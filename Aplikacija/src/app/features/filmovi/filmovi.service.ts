import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class FilmoviService {
  // Spoljni API (lista filmova)
  private externalApiUrl =
    'https://movie.pequla.com/api/movie?director=&actor=&search=&genre=';

  // Tvoj backend (port po .env kod tebe je 4000): prefiks /api
  private apiBase = 'http://localhost:4000/api';

  private isBrowser: boolean;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  /** Lista filmova sa spoljnog API-ja */
  getFilmovi(): Observable<any[]> {
    return this.http.get<any[]>(this.externalApiUrl).pipe(
      catchError((err) => {
        console.error('Greška pri učitavanju filmova:', err);
        return throwError(() => new Error('Greška pri učitavanju filmova'));
      })
    );
  }

  /** Recenzije za film (kad dodaš rute na backendu) */
  getReviews(movieId: number): Observable<any[]> {
    return this.http
      .get<any[]>(`${this.apiBase}/reviews`, { params: { filmId: movieId } })
      .pipe(
        catchError((err) => {
          console.error('Greška pri učitavanju recenzija:', err);
          return throwError(() => new Error('Greška pri učitavanju recenzija'));
        })
      );
  }

  submitReview(review: { filmId: number; rating: number; comment: string }): Observable<any> {
    let headers = new HttpHeaders();
    if (this.isBrowser) {
      const token = localStorage.getItem('token');
      if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return this.http.post(`${this.apiBase}/reviews`, review, { headers }).pipe(
      tap(() => console.log('Recenzija poslata')),
      catchError((err) => {
        console.error('Greška pri slanju recenzije:', err);
        return throwError(() => new Error('Greška pri slanju recenzije'));
      })
    );
  }

  deleteReviews(movieId: number): Observable<any> {
    return this.http
      .delete(`${this.apiBase}/reviews`, { params: { filmId: movieId } })
      .pipe(
        tap(() => console.log('Recenzije obrisane')),
        catchError((err) => {
          console.error('Greška pri brisanju recenzija:', err);
          return throwError(() => new Error('Greška pri brisanju recenzija'));
        })
      );
  }
}
