"""Knowledge graph for storing and inferring facts and relationships"""

from typing import Dict, List, Tuple, Optional, Set
from collections import deque, defaultdict


class KnowledgeGraph:
    """Graph-based knowledge representation with inference capabilities"""
    
    def __init__(self):
        self.nodes: Dict[str, Dict] = {}
        self.edges: Dict[str, List[Tuple[str, str]]] = defaultdict(list)
    
    def add_fact(self, subject: str, predicate: str, obj: str, confidence: float = 1.0):
        """Add a fact (triple) to the knowledge graph"""
        # Add nodes if they don't exist
        if subject not in self.nodes:
            self.nodes[subject] = {"type": "entity", "confidence": confidence}
        if obj not in self.nodes:
            self.nodes[obj] = {"type": "entity", "confidence": confidence}
        
        # Add edge with predicate
        self.edges[subject].append((obj, predicate))
    
    def query(self, subject: str, predicate: Optional[str] = None) -> List[Tuple[str, str]]:
        """Query facts about a subject, optionally filtered by predicate"""
        if subject not in self.edges:
            return []
        
        results = self.edges[subject]
        if predicate:
            results = [(obj, rel) for obj, rel in results if rel == predicate]
        
        return results
    
    def infer(self, subject: str, max_hops: int = 3) -> Dict[str, List[str]]:
        """Infer connected entities using BFS (breadth-first search)"""
        visited: Set[str] = set()
        inferred = defaultdict(list)
        queue = deque([(subject, 0)])
        
        while queue:
            current, depth = queue.popleft()
            if depth > max_hops or current in visited:
                continue
            
            visited.add(current)
            
            # Get all connected entities
            for target, relation in self.edges[current]:
                inferred[relation].append(target)
                queue.append((target, depth + 1))
        
        return dict(inferred)
    
    def get_paths(self, start: str, end: str, max_depth: int = 5) -> List[List[str]]:
        """Find all paths between two entities using DFS"""
        paths = []
        visited = set()
        
        def dfs(current: str, target: str, path: List[str], depth: int):
            if depth > max_depth or current in visited:
                return
            
            visited.add(current)
            path.append(current)
            
            if current == target:
                paths.append(path[:])
            else:
                for next_entity, _ in self.edges[current]:
                    dfs(next_entity, target, path, depth + 1)
            
            path.pop()
            visited.discard(current)
        
        dfs(start, end, [], 0)
        return paths
    
    def get_all_facts(self) -> List[Tuple[str, str, str]]:
        """Get all facts in the graph as (subject, predicate, object) tuples"""
        facts = []
        for subject, relations in self.edges.items():
            for obj, predicate in relations:
                facts.append((subject, predicate, obj))
        return facts
