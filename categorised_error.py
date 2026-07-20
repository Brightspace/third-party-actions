class CategorisedError(Exception):
    """Exception class for failures that can be categorised."""

    def __init__(self, message: str, error_type: str):
        super().__init__(message)
        self.type = error_type
