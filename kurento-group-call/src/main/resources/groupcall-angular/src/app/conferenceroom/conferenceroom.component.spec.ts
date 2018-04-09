import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ConferenceroomComponent } from './conferenceroom.component';

describe('ConferenceroomComponent', () => {
  let component: ConferenceroomComponent;
  let fixture: ComponentFixture<ConferenceroomComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ConferenceroomComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ConferenceroomComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
