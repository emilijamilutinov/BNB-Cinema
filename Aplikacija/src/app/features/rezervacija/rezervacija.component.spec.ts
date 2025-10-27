import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RezervacijaComponent } from './rezervacija.component';

describe('RezervacijaComponent', () => {
  let component: RezervacijaComponent;
  let fixture: ComponentFixture<RezervacijaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RezervacijaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RezervacijaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
