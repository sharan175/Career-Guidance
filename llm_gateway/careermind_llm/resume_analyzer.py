"""Comprehensive Resume, ATS, and Target Company Analyzer."""
import json
import logging
import re

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """
You are an elite Tech Career Coach, Senior Engineering Hiring Manager, and ATS Expert.
Analyze the student's resume against their Target Career, Selected Priority Skills, and Target Companies.

Produce a comprehensive evaluation strictly in the following JSON structure:
{
  "ats_score": <integer 0-100 based on keywords, structure, impact, clarity>,
  "verdict": {
    "status": "ready" | "needs_upskilling" | "needs_resume_polish",
    "summary": "<2-3 sentence executive decision on their current readiness>"
  },
  "skill_analysis": {
    "matched_skills": [
      {"name": "<Skill Name>", "level": <1-5>, "evidence": "<where it was seen in resume>"}
    ],
    "missing_skills": [
      {"name": "<Skill Name>", "target_level": <1-5>, "reason": "<why this is a gap for their goal>"}
    ]
  },
  "company_fit": {
    "target_companies": "<company names>",
    "evaluation": "<specific insights into what these target companies test and care about>",
    "hiring_bar_advice": "<specific preparation needed to pass their interviews>"
  },
  "resume_building_tips": [
    "<actionable advice on formatting, action verbs, quantifying results, or structure>"
  ],
  "learning_roadmap": [
    "<specific projects or technical topics to master next to close the gap>"
  ]
}

Rules:
- Give genuine, honest, high-standard evaluation.
- Format strictly as valid JSON with NO markdown backticks or extra prose.
"""

def analyze_resume_full(
    resume_text: str,
    target_career: str,
    specified_skills: list[str],
    target_companies: str,
    client=None,
) -> dict:
    if client is None:
        from careermind_llm.client import get_client
        client = get_client()

    user_prompt = f"""
TARGET CAREER PATHWAY: {target_career}
TARGET COMPANIES: {target_companies or 'Top Technology Companies'}
PRIORITY SKILLS TO EVALUATE: {', '.join(specified_skills) if specified_skills else 'All standard prerequisites'}

STUDENT RESUME TEXT:
{resume_text[:6000]}
"""

    response = client.complete(
        [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
        max_tokens=1500,
    )

    cleaned = re.sub(r"^```(?:json)?\s*", "", response.strip())
    cleaned = re.sub(r"\s*```$", "", cleaned).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as err:
        logger.error("JSON parsing failed: %s", cleaned)
        raise ValueError("Failed to parse ATS and resume analysis output") from err