class WindmillNotFound(Exception):
    pass


class FarmNotFound(Exception):
    pass


class WindmillAlreadyRunning(Exception):
    pass


class WindmillIsRunning(Exception):
    """Raised when an operation is blocked because the windmill is running."""
    pass


class DuplicateName(Exception):
    pass


class DuplicateWindmillId(Exception):
    pass


class FarmHasWindmills(Exception):
    pass
