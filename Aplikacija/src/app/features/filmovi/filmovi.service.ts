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

  // moj backend: prefiks /api
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
  /////odavde ////
  private authHeaders(): HttpHeaders {
    if (!this.isBrowser) return new HttpHeaders();
    const token = localStorage.getItem('token');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  getTakenSeats(film_title: string, datum: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiBase}/taken-seats`, {
      params: { film_title, datum }
    });
  }

  // >>> potvrda rezervacije (čuva u bazi)
  postRezervacija(body: {
    film_title: string;
    datum: string;
    seats: { row: string; num: number }[];
    total: number; // ili 0 ako računaš na serveru
  }): Observable<any> {
    return this.http.post(`${this.apiBase}/rezervacije`, body, {
      headers: this.authHeaders()
    });
  }
  ////do ovde ///


  /** Recenzije za film  */
  getReviews(movieId: number): Observable<any[]> {
  return this.http
    .get<any[]>(`${this.apiBase}/reviews/${movieId}`)
    .pipe(
      catchError((err) => {
        console.error('Greška pri učitavanju recenzija:', err);
        return throwError(() => new Error('Greška pri učitavanju recenzija'));
      })
    );
}


  submitReview(
  review: { filmId: number; filmTitle: string; rating: number; comment: string }
): Observable<any> {
  let headers = new HttpHeaders();
  if (this.isBrowser) {
    const token = localStorage.getItem('token');
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
  }
  return this.http.post(`${this.apiBase}/reviews`, review, { headers }).pipe(
    tap(() => console.log('Recenzija poslata')),
    // filmovi.service.ts (submitReview catchError)
catchError((err) => {
  const msg = err?.error?.message || 'Greška pri slanju recenzije';
  console.error('Greška pri slanju recenzije:', err);
  return throwError(() => new Error(msg));
})

  );
}


  deleteMyReview(movieId: number): Observable<any> {
  let headers = new HttpHeaders();
  if (this.isBrowser) {
    const token = localStorage.getItem('token');
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
  }
  return this.http
    .delete(`${this.apiBase}/reviews/${movieId}`, { headers })
    .pipe(
      tap(() => console.log('Recenzija obrisana')),
      catchError((err) => {
        console.error('Greška pri brisanju recenzije:', err);
        return throwError(() => new Error('Greška pri brisanju recenzije'));
      })
    );
  }
  getAvgRating(movieId: number): Observable<{ avg: number | null }> {
  return this.http.get<{ avg: number | null }>(`${this.apiBase}/reviews/${movieId}/avg`);
}

}
