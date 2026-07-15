class CategorisedError(Exception):
    """Exception class for failures that can be categorised."""
    def __init__(self, message: str, type: str ):
        super().__init__(message)
        self.type = type