from pydantic import BaseModel, ConfigDict
from typing import Optional

class BaseCardForm(BaseModel):
    model_config = ConfigDict(strict=True)
    category: str
    theme: str = "default"
    mood: str = "light-soothing"
    font: str = "Arial"
    style: str = "classic"
    alignment: str = "center"
    margin: int = 40
    padding: int = 20

class WeddingCardForm(BaseCardForm):
    groom_name: str
    bride_name: str
    date: str
    time: str
    venue: str

class BirthdayCardForm(BaseCardForm):
    name: str
    age: int
    date: str
    time: str
    venue: str

class BusinessCardForm(BaseCardForm):
    company_name: str
    employee_name: str
    designation: str
    email: str
    phone: str
    website: Optional[str] = None

class GreetingCardForm(BaseCardForm):
    recipient_name: str
    sender_name: str
    message: str
    occasion: str

class ClientBase(BaseModel):
    name: str
    email: str
    phone: str
    address: str

class ClientCreate(ClientBase):
    pass

class ClientResponse(ClientBase):
    id: str
    created_at: str

class ProjectBase(BaseModel):
    category: str
    theme: str
    metadata: dict

class ProjectCreate(ProjectBase):
    pass

class ProjectResponse(ProjectBase):
    id: str
    client_id: str
    created_at: str
