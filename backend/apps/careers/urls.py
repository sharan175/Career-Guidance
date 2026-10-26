from django.urls import path

from . import views

urlpatterns = [
    path("pathways", views.PathwayListView.as_view()),
    path("predictions", views.CareerPredictionView.as_view()),
    path("resume-analysis", views.ResumeAnalysisView.as_view(), name="resume-analysis"),
]
