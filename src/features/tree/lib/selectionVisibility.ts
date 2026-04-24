export interface RectLike {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export function isRectFullyVisibleWithinContainer(
    rect: RectLike,
    container: RectLike,
    margin: number,
): boolean {
    return (
        rect.left >= container.left + margin &&
        rect.right <= container.right - margin &&
        rect.top >= container.top + margin &&
        rect.bottom <= container.bottom - margin
    );
}