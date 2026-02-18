from rest_framework import permissions


class IsInGroupOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True

        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        if view.action in ['create', 'update', 'partial_update']:
            return request.user.groups.filter(
                name__in=['Supervisor', 'Floor Staff', 'Admin']
            ).exists()

        if view.action in ['destroy']:
            return request.user.groups.filter(
                name__in=['Admin']
            ).exists()

        return True


class IsSupervisor(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and (
            request.user.is_superuser or
            request.user.groups.filter(name='Supervisor').exists()
        )


class IsFloorStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and (
            request.user.is_superuser or
            request.user.groups.filter(name='Floor Staff').exists()
        )


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and (
            request.user.is_superuser or
            request.user.groups.filter(name='Admin').exists()
        )
