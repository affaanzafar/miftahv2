from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models_learning import Article
from app.schemas_learning import ArticleOut

router = APIRouter(prefix="/articles", tags=["articles"])


@router.get("", response_model=list[ArticleOut])
def list_articles(db: Session = Depends(get_db)):
    articles = (
        db.query(Article)
        .filter(Article.is_published == True)  # noqa: E712
        .order_by(Article.created_at.desc())
        .all()
    )
    return [
        ArticleOut(
            id=a.id, title=a.title, slug=a.slug, body=a.body, pdf_url=a.pdf_url,
            is_published=a.is_published, created_at=a.created_at, word_count=len(a.body.split()),
        )
        for a in articles
    ]


@router.get("/{slug}", response_model=ArticleOut)
def get_article(slug: str, db: Session = Depends(get_db)):
    a = db.query(Article).filter(Article.slug == slug, Article.is_published == True).first()  # noqa: E712
    if not a:
        raise HTTPException(status_code=404, detail="Article not found")
    return ArticleOut(
        id=a.id, title=a.title, slug=a.slug, body=a.body, pdf_url=a.pdf_url,
        is_published=a.is_published, created_at=a.created_at, word_count=len(a.body.split()),
    )
