from django.urls import path

from . import views

urlpatterns = [
    path("generate", views.GenerateRoadmapView.as_view()),
    path("mine", views.MyGeneratedRoadmapsView.as_view()),
    path("<slug:slug>", views.GeneratedRoadmapView.as_view()),
]
