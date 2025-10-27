import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FilmoviService } from '../filmovi/filmovi.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit {
  randomFilmovi: any[] = [];

  constructor(private filmoviService: FilmoviService) {}

  ngOnInit(): void {
    this.filmoviService.getFilmovi().subscribe({
      next: (data: any[]) => {
        this.randomFilmovi = this.pickRandom(data, 5);
      },
      error: (err) => console.error('Greška pri učitavanju filmova:', err),
    });
  }

  /** Vrati nasumičnih `count` filmova bez mutiranja originalnog niza */
  private pickRandom(films: any[], count: number): any[] {
    const arr = [...(films || [])];
    // Fisher–Yates shuffle
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, Math.max(0, count));
  }
}
