import { AfterViewChecked, ChangeDetectorRef, Component, ElementRef, ViewChild } from '@angular/core';

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
  @ViewChild('messagesEndRef') messagesEndRef!: ElementRef;

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
    console.log(this.messages);
    try {
      this.messagesEndRef.nativeElement.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  // מטפל בשליחת הודעה: מעדכן את הממשק, פונה לשרת ומציג את התוצאה.
  async handleSendMessage(e: Event): Promise<void> {
    e.preventDefault();

    // לא שולחים הודעה ריקה או כזו שמכילה רק רווחים.
    if (!this.input.trim()) return;

    // מוסיפים את הודעת המשתמש לשיחה לפני הפנייה לשרת.
    const userMessage: Message = {
      id: Date.now(),
      type: 'user',
      content: this.input,
      timestamp: new Date(),
    };

    this.messages.push(userMessage);
    const inputValue = this.input;
    this.input = '';
    this.isLoading = true;

    try {
      // שולחים לשרת את המודל ואת היסטוריית השיחה בפורמט שהוא מצפה לקבל.
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
              // השרת מכיר בתפקידים user ו-assistant; הודעות שגיאה אינן נשלחות.
              role: message.type === 'user' ? 'user' : 'assistant',
              content: message.content,
            })),
        }),
      });

      // תשובה שאינה הצלחה הופכת לשגיאה עם פרטי התשובה מהשרת.
      if (!response.ok) {
        const errorDetails = await response.text();
        throw new Error(errorDetails || `API Error: ${response.statusText}`);
      }

      const data = await response.json();

      // מציגים את תשובת ה-AI ואת שם המודל שהשרת החזיר.
      const aiMessage: Message = {
        id: Date.now() + 1,
        type: 'ai',
        content: data.output_text,
        model: data.model,
        timestamp: new Date(),
      };

      this.messages.push(aiMessage);
    } catch (error: unknown) {
      // במקרה של כשל, מציגים הודעת שגיאה מתאימה ושומרים את הפרטים בלוג.
      console.error('Error:', error);
      const errorDetails = error instanceof Error ? error.message : String(error);
      const isSafeAiError = /SAFEAI/i.test(errorDetails);

      // שגיאות SAFEAI מקבלות הודעה ידידותית; בשאר המקרים מוצגים פרטי השגיאה.
      const errorMessage: Message = {
        id: Date.now() + 1,
        type: 'error',
        content: isSafeAiError ? 'השאלה נחסמה עקב סיבות רוחניות' : `שגיאה: ${errorDetails}`,
        timestamp: new Date(),
      };

      this.messages.push(errorMessage);
    } finally {
      // תמיד מסתירים את מצב הטעינה ומבקשים מ-Angular לעדכן את התצוגה.
      this.isLoading = false;
      this.changeDetector.markForCheck();
    }
  }

  // מאפס את רשימת ההודעות כדי להתחיל שיחה חדשה.
  handleClearChat(): void {
    this.messages = [];
  }

  // ממיר את זמן ההודעה למחרוזת שעה לפי הפורמט המקומי בעברית.
  formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString('he-IL');
  }
}
