declare module 'git-rev-sync' {
    export function short(filePath?: string): string
    export function long(filePath?: string): string
    export function branch(filePath?: string): string
}
