from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel
from openai import OpenAI
import httpx
from typing import Literal

# =========== Config ===========
# כתובת שירות ה-AI ומפתח הגישה אליו.
API_KEY = "sk-safeai-dfa2d649b8d1b5c974a5f72e97575e3d6b604d5f7ade2ce1"
BASE_URL = "https://safeai613.com/v1"

# =========== FastAPI Setup ===========
# יצירת אפליקציית FastAPI, כולל פרטים שיופיעו בתיעוד האוטומטי.
app = FastAPI(title="SafeAI API", version="1.0.0")


# =========== CORS Middleware ===========
# מאפשר לדפדפן לשלוח בקשות לשרת רק מהכתובות המורשות כאן.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://localhost:3000",      
        "http://localhost:4200",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:4200",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========== Models ===========
# הודעה בודדת בשיחה; Literal מגביל את role ל-user או assistant.
class ConversationMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

# גוף הבקשה ל-/generate: קלט יכול להיות טקסט פשוט או רשימת הודעות.
class RequestModel(BaseModel):
    model: str = "gpt-4o-mini"
    input: str | list[ConversationMessage]

# המבנה האחיד שיוחזר ללקוח.
class ResponseModel(BaseModel):
    output_text: str
    model: str

# =========== Initialize Client ===========
# לקוח HTTP שמשמש את ספריית OpenAI לשליחת בקשות לשירות.
# שימו לב: verify=False מבטל בדיקת תעודת TLS ולכן אינו מומלץ בסביבת production.
httpx_client = httpx.Client(http2=True, verify=False)

# יצירת לקוח OpenAI שמכוון לכתובת ולמפתח של שירות SafeAI.
client = OpenAI(
    base_url=BASE_URL,
    api_key=API_KEY,
    http_client=httpx_client
)

# =========== Routes ===========
# נקודת קצה שמקבלת קלט, שולחת אותו למודל ומחזירה את הטקסט שנוצר.
@app.post("/generate", response_model=ResponseModel)
async def generate_content(request: RequestModel):
    """
    Generate content using SafeAI API
    """
    try:
        response = client.responses.create(
            model=request.model,
            input=(
                # המרת אובייקטי Pydantic למילונים בפורמט שה-SDK מצפה לו.
                [message.model_dump() for message in request.input]
                if isinstance(request.input, list)
                else request.input
            )
        )
        return ResponseModel(
            output_text=response.output_text,
            model=request.model
        )
    except Exception as e:
        # במקרה של כשל בשירות החיצוני או בעיבוד, מחזירים ללקוח שגיאת HTTP 500.
        raise HTTPException(status_code=500, detail=str(e))


# =========== Shutdown Event ===========
# סגירת חיבור ה-HTTP בעת כיבוי האפליקציה כדי לשחרר משאבים.
@app.on_event("shutdown")
async def shutdown_event():
    """
    Close httpx client on shutdown
    """
    httpx_client.close()


if __name__ == "__main__":
    import uvicorn
    # מאפשר להריץ את השרת ישירות: מאזין על כל ממשקי הרשת בפורט 8000.
    uvicorn.run(app, host="0.0.0.0", port=8000)
