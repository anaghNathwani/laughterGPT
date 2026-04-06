class MemoryBank:
    def __init__(self):
        self.short_term_memory = []
        self.long_term_memory = []

    def add_to_short_term(self, item):
        self.short_term_memory.append(item)

    def add_to_long_term(self, item):
        self.long_term_memory.append(item)

    def promote_to_long_term(self, item):
        if item in self.short_term_memory:
            self.short_term_memory.remove(item)
            self.add_to_long_term(item)

    def recall(self, query):
        # Implement similarity-based retrieval logic here
        pass

    def apply_decay(self):
        # Implement exponential decay logic here
        pass

    def _evict_least_important(self):
        # Implement LRU eviction logic here
        pass
