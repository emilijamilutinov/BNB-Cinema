import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { FilmoviComponent } from './filmovi.component';
import { FilmoviService } from './filmovi.service';

describe('FilmoviComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilmoviComponent],
      providers: [FilmoviService, provideHttpClient()],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(FilmoviComponent);
    const comp = fixture.componentInstance;
    expect(comp).toBeTruthy();
  });
});
