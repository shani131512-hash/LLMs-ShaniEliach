import { ChangeDetectorRef, Component, signal, ViewChild } from '@angular/core';

import { RouterOutlet } from '@angular/router';
import { Chat } from './chat/chat';

interface ExerciseResult {
  grade: number;
  feedback: string;
  improvements: string[];
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Chat],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('aiChatFrontend');
  constructor(private cdr: ChangeDetectorRef) {}

  @ViewChild(Chat) chat!: Chat;

  exercise: string =
    'כתוב דף HTML בסיסי עם כותרת, פסקה וכפתור. הכפתור צריך להציג הודעה כאשר לוחצים עליו.';

  result: ExerciseResult | null = null;
  isChecking = false;

  async checkExercise(solution: string): Promise<void> {
    if (!solution.trim()) {
      alert('יש להזין פתרון');
      return;
    }

    this.isChecking = true;
    this.result = null;

    try {
      const response = await fetch('http://localhost:8000/check-exercise', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exercise: this.exercise,
          solution: solution,
          model: 'gpt-5.4-nano',
        }),
      });

      if (!response.ok) {
        const errorDetails = await response.text();
        throw new Error(errorDetails);
      }

      this.result = (await response.json()) as ExerciseResult;
      this.cdr.detectChanges();
      console.log('Exercise result:', this.result); 
      this.isChecking = false;
    } catch (error: any) {
      console.error('Error checking exercise:', error);

      const errorMessage = error.message || '';

      if (errorMessage.includes('blocked-by-llm')) {
        alert('לא ניתן לבדוק את הפתרון. ייתכן שהתוכן שהוזן אינו תואם לדרישות התרגול.');
      } else {
        alert('אירעה שגיאה בבדיקת התרגיל. נסי שוב מאוחר יותר.');
      }
    }
  }

  mode: 'chat' | 'exercise' = 'chat';
}
