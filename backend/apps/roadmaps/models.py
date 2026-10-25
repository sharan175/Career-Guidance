"""MongoEngine documents for AI-generated career roadmaps.

`roadmap` stores the full frontend-schema JSON (same shape as the seed files
in frontend/src/data/roadmaps/) so the client renders generated roadmaps
through the exact same canvas/drawer as curated ones.
"""
from mongoengine import Document, fields


class GeneratedRoadmap(Document):
    """One Gemini-generated roadmap, owned by one student.

    Regenerating the same career slug replaces the previous document (unique
    per (student, slug)).
    """

    student = fields.StringField(required=True)  # PII-free student_id (NFR05)
    slug = fields.StringField(required=True)
    title = fields.StringField(required=True)
    description = fields.StringField(default="")
    roadmap = fields.DictField(required=True)
    generated_at = fields.DateTimeField(required=True)

    meta = {
        "collection": "generated_roadmaps",
        "indexes": [{"fields": ["student", "slug"], "unique": True}],
        "allow_inheritance": False,
    }
