import cloudinary
import cloudinary.uploader
from fastapi import HTTPException, UploadFile

from app.core.config import settings

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True,
)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_DOCUMENT_TYPES = ALLOWED_IMAGE_TYPES | {"application/pdf"}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5MB


async def upload_file(file: UploadFile, folder: str, allow_documents: bool = False) -> dict:
    allowed = ALLOWED_DOCUMENT_TYPES if allow_documents else ALLOWED_IMAGE_TYPES
    if file.content_type not in allowed:
        raise HTTPException(status_code=422, detail=f"Unsupported file type: {file.content_type}")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=422, detail="File exceeds the 5MB maximum upload size.")

    resource_type = "auto" if allow_documents else "image"
    result = cloudinary.uploader.upload(contents, folder=folder, resource_type=resource_type)
    return {"url": result["secure_url"], "public_id": result["public_id"]}
