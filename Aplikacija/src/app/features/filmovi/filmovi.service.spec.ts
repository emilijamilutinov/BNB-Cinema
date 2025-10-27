import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { FilmoviService } from './filmovi.service';

describe('FilmoviService', () => {
  let service: FilmoviService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FilmoviService, provideHttpClient()],
    });
    service = TestBed.inject(FilmoviService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
