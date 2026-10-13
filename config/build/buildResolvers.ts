import { ResolveOptions } from "webpack";

export function buildResolvers (): ResolveOptions {
    return {
        extensions: ['.tsx', '.ts', '.js'],
        fallback: {
            buffer: require.resolve('buffer/'),
        },
      }
}