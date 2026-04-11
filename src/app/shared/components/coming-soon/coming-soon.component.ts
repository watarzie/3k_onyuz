import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-coming-soon',
  standalone: true,
  template: `
    <div class="coming-soon">
      <div class="icon-wrapper">
        <i class="ri-tools-line"></i>
      </div>
      <h3>{{ title() }}</h3>
      <p>Bu modül yakında aktif olacaktır.</p>
    </div>
  `,
  styles: [`
    .coming-soon {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; min-height: 60vh; text-align: center;
    }
    .icon-wrapper {
      width: 80px; height: 80px; border-radius: 20px;
      background: linear-gradient(135deg, #605DFF, #8B5CF6);
      display: flex; align-items: center; justify-content: center;
      font-size: 36px; color: #fff; margin-bottom: 20px;
    }
    h3 { color: var(--blackColor); font-weight: 700; }
    p { color: var(--bodyColor); font-size: 14px; }
  `],
})
export class ComingSoonComponent implements OnInit {
  private route = inject(ActivatedRoute);
  title = signal('Yakında');

  ngOnInit() {
    const data = this.route.snapshot.data;
    if (data['title']) {
      this.title.set(data['title']);
    }
  }
}
