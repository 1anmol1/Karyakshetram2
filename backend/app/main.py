"""
Karyakshetram Machine Learning Service (FastAPI)
Exposes the 300-tree RandomForest ML pipeline, spatial feature matrices,
Huff cannibalisation, and portfolio optimization for Karyakshetram.
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from app.model_engine import engine

INTERNAL_KEY = os.getenv('ML_INTERNAL_KEY', 'dev-ml-key-change-in-prod')

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[FastAPI] Initializing ML service and spatial matrices...")
    engine.load()
    yield
    print("[FastAPI] Shutting down ML service.")

app = FastAPI(
    title="Karyakshetram ML Service",
    description="RandomForestRegressor Inference, Spatial Matrices, and Huff Network Optimization",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def verify_key(x_internal_key: Optional[str] = Header(None)):
    if INTERNAL_KEY and x_internal_key != INTERNAL_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized: invalid X-Internal-Key")

# ----------------- Request Models -----------------
class ScoreRequest(BaseModel):
    cell: str
    category: str = "grocery"
    assumptions: Optional[Dict[str, Any]] = None

class CellsRequest(BaseModel):
    category: str = "grocery"
    assumptions: Optional[Dict[str, Any]] = None

class RecommendRequest(BaseModel):
    category: str = "grocery"
    constraints: Optional[Dict[str, Any]] = None
    assumptions: Optional[Dict[str, Any]] = None
    focusAreas: Optional[List[str]] = None
    excludeLow: Optional[bool] = True
    own: Optional[List[Dict[str, Any]]] = None
    grid: Optional[str] = "res8"

class StressRequest(BaseModel):
    cell: str
    category: str = "grocery"
    assumptions: Optional[Dict[str, Any]] = None

class CannibalisationRequest(BaseModel):
    site: Dict[str, Any]
    own: Optional[List[Dict[str, Any]]] = None
    category: str = "grocery"

class AlternativesRequest(BaseModel):
    cell: str
    category: str = "grocery"
    count: Optional[int] = 3
    assumptions: Optional[Dict[str, Any]] = None

class PortfolioRequest(BaseModel):
    category: str = "grocery"
    k: Optional[int] = 5
    spacingKm: Optional[float] = 1.5
    budget: Optional[float] = None
    assumptions: Optional[Dict[str, Any]] = None
    own: Optional[List[Dict[str, Any]]] = None

class RecalibrateRequest(BaseModel):
    category: str = "grocery"
    outcomes: Optional[List[Dict[str, Any]]] = None

# ----------------- Endpoints -----------------
@app.get("/health")
@app.post("/ml/health")
def health():
    return {
        "status": "ok",
        "mode": "remote",
        "model": "RandomForestRegressor (300 trees)",
        "version": "1.0.0",
        "cells": len(engine.cells),
        "loadedAt": engine.loaded_at,
    }

@app.post("/ml/reload")
def reload_state(x_internal_key: Optional[str] = Header(None)):
    """Called by the Node API after a live competitor sync or a what-if closure."""
    verify_key(x_internal_key)
    engine.load()
    return {"ok": True, "loadedAt": engine.loaded_at}

@app.get("/meta")
def meta():
    return {
        "project": "KARYAKSHETRAM",
        "model": "RandomForestRegressor (300 trees)",
        "metadata": engine.metadata,
        "cells_loaded": len(engine.cells),
        "profiles_loaded": len(engine.profiles_by_key),
    }

@app.post("/ml/score")
def score(req: ScoreRequest, x_internal_key: Optional[str] = Header(None)):
    verify_key(x_internal_key)
    cell = engine.cells_by_id.get(req.cell)
    if not cell:
        raise HTTPException(status_code=404, detail=f"Cell {req.cell} not found")
    result = engine.score_cell(cell, req.category, req.assumptions)
    return {"result": result, "source": "ml"}

@app.post("/ml/cells")
def cells(req: CellsRequest, x_internal_key: Optional[str] = Header(None)):
    verify_key(x_internal_key)
    results = engine.score_all(req.category, req.assumptions)
    return {"results": results, "source": "ml"}

@app.post("/ml/recommend")
def recommend(req: RecommendRequest, x_internal_key: Optional[str] = Header(None)):
    verify_key(x_internal_key)
    res = engine.recommend(
        category=req.category,
        constraints=req.constraints or {},
        assumptions=req.assumptions or {},
        focus_areas=req.focusAreas or [],
        exclude_low=req.excludeLow if req.excludeLow is not None else True,
        own=req.own or [],
        grid=req.grid or "res8",
    )
    return {**res, "source": "ml"}

@app.post("/ml/stress")
def stress(req: StressRequest, x_internal_key: Optional[str] = Header(None)):
    verify_key(x_internal_key)
    cell = engine.cells_by_id.get(req.cell)
    if not cell:
        raise HTTPException(status_code=404, detail=f"Cell {req.cell} not found")
    scored = engine.score_cell(cell, req.category, req.assumptions)
    return {"stress": scored["stress"], "source": "ml"}

@app.post("/ml/cannibalisation")
def cannibalisation(req: CannibalisationRequest, x_internal_key: Optional[str] = Header(None)):
    verify_key(x_internal_key)
    res = engine.cannibalisation(req.site, req.own or [], req.category)
    return {**res, "source": "ml"}

@app.post("/ml/alternatives")
def alternatives(req: AlternativesRequest, x_internal_key: Optional[str] = Header(None)):
    verify_key(x_internal_key)
    alts = engine.nearest_suitable(req.cell, req.category, req.count or 3, req.assumptions)
    return {"alternatives": alts, "source": "ml"}

@app.post("/ml/portfolio")
def portfolio(req: PortfolioRequest, x_internal_key: Optional[str] = Header(None)):
    verify_key(x_internal_key)
    res = engine.portfolio(
        category=req.category,
        k=req.k or 5,
        spacing_km=req.spacingKm or 1.5,
        budget=req.budget,
        assumptions=req.assumptions or {},
        own=req.own or [],
    )
    return {**res, "source": "ml"}

@app.post("/ml/recalibrate")
def recalibrate(req: RecalibrateRequest, x_internal_key: Optional[str] = Header(None)):
    verify_key(x_internal_key)
    res = engine.recalibrate(req.category, req.outcomes or [])
    return {**res, "source": "ml"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
