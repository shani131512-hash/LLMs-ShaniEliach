import {
  AfterViewChecked,
  ChangeDetectorRef,
  Component,
  ElementRef,
  ViewChild,
} from '@angular/core';

// המבנה של הודעה שמוצגת בצ'אט, כולל סוג ההודעה והזמן שבו נשלחה.
interface Message {
  id: number;
  type: 'user' | 'ai' | 'error';
  content: string;
  model?: string;
  timestamp: Date;
}

// המבנה שהשרת מצפה לקבל עבור כל הודעה בהיסטוריית השיחה.
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// הגדרות Angular של רכיב הצ'אט והקבצים שמכילים את התבנית והעיצוב שלו.
@Component({
  selector: 'app-chat',
  imports: [],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
  standalone: true,
})
export class Chat implements AfterViewChecked {
  // הפניה לאלמנט שבתחתית רשימת ההודעות, כדי לגלול אליו כשצריך.
  @ViewChild('messagesEndRef')
  messagesEndRef?: ElementRef<HTMLDivElement>;

  // מצב הצ'אט: הודעות, הטקסט בשדה הקלט, מצב טעינה והמודל שנשלח לשרת.
  messages: Message[] = [];
  input: string = '';
  isLoading: boolean = false;
  model: string = 'gpt-5.4-nano';

  // כתובת שרת ה-API המקומי שמייצר תשובות.
  private readonly API_BASE_URL = 'http://localhost:8000';

  constructor(private changeDetector: ChangeDetectorRef) {}

  // Angular קורא למתודה אחרי בדיקת התצוגה; כאן מגלגלים לתחתית הצ'אט.
  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  // גולל להודעה האחרונה כדי שהיא תישאר גלויה.
  scrollToBottom(): void {
    const element = this.messagesEndRef?.nativeElement;

    if (!element) {
      return;
    }

    element.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }

  // מאפס את רשימת ההודעות כדי להתחיל שיחה חדשה.
  handleClearChat(): void {
    this.messages = [];
  }

  // ממיר את זמן ההודעה למחרוזת שעה לפי הפורמט המקומי בעברית.
  formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString('he-IL');
  }

  async handleSendMessage(e: Event): Promise<void> {
    e.preventDefault();

    if (!this.input.trim() || this.isLoading) return;

    this.messages.push({
      id: Date.now(),
      type: 'user',
      content: this.input.trim(),
      timestamp: new Date(),
    });

    this.input = '';

    await this.sendToAI();
  }

  async handleSendExercise(exerciseDescription: string, solution: string): Promise<void> {
    if (!solution.trim() || this.isLoading) return;

    const exerciseMessage = `
אני רוצה שתבדוק את הפתרון שלי לתרגיל הבא.

התרגיל:
${exerciseDescription}

הפתרון שלי:
${solution}

בדוק האם הפתרון נכון, הסבר על טעויות אם קיימות,
ותן לי משוב והצעות לשיפור.
`;

    this.messages.push({
      id: Date.now(),
      type: 'user',
      content: exerciseMessage,
      timestamp: new Date(),
    });

    await this.sendToAI();
  }

  // שליחת הודעה לשרת Python וקבלת תשובת ה-AI.
  private async sendToAI(): Promise<void> {
    this.isLoading = true;

    try {
      const response = await fetch(`${this.API_BASE_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: this.messages
            .filter((message) => message.type === 'user' || message.type === 'ai')
            .map((message): ConversationMessage => ({
              role: message.type === 'user' ? 'user' : 'assistant',
              content: message.content,
            })),
        }),
      });

      if (!response.ok) {
        const errorDetails = await response.text();
        throw new Error(errorDetails || `API Error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('תשובה שהתקבלה מהשרת:', data);
      console.log('תוכן התשובה:', data.output_text);

      this.messages.push({
        id: Date.now() + 1,
        type: 'ai',
        content: data.output_text,
        model: data.model,
        timestamp: new Date(),
      });
    } catch (error: unknown) {
      console.error('Error:', error);

      const errorDetails = error instanceof Error ? error.message : String(error);

      this.messages.push({
        id: Date.now() + 1,
        type: 'error',
        content: `שגיאה: ${errorDetails}`,
        timestamp: new Date(),
      });
    } finally {
      this.isLoading = false;
      this.changeDetector.markForCheck();
    }
  }
}
