import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BaseApiService } from './base-api.service';

describe('BaseApiService onay ve hata sözleşmesi',()=>{
  beforeEach(()=>TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),BaseApiService]}));
  afterEach(()=>TestBed.inject(HttpTestingController).verify());
  it('202 onay kabulünü işlemin sonucundan ayırır',()=>{
    TestBed.inject(BaseApiService).post('/test',{}).subscribe(result=>{expect(result.statusCode).toBe(202);expect(result.isSuccess).toBeTrue();});
    TestBed.inject(HttpTestingController).expectOne('/test').flush({message:'Onaya alındı',statusCode:202},{status:202,statusText:'Accepted'});
  });
  it('gövdedeki başarısız iş sonucunu başarı olarak tekrar sarmaz',()=>{
    TestBed.inject(BaseApiService).post('/test',{}).subscribe(result=>{expect(result.isSuccess).toBeFalse();expect(result.error).toBe('Bakiye aşıldı');});
    TestBed.inject(HttpTestingController).expectOne('/test').flush({isSuccess:false,error:'Bakiye aşıldı'});
  });
});
