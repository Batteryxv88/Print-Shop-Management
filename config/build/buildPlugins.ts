import HtmlWebpackPlugin from "html-webpack-plugin";
import webpack from 'webpack';
import path from 'path';
import { BuildOptions } from "./types/config";
import MiniCssExtractPlugin from "mini-css-extract-plugin"

export function buildPlugins ({paths}: BuildOptions): webpack.WebpackPluginInstance[] {
    return [
        new HtmlWebpackPlugin({
            template: paths.html,
            favicon: path.resolve(paths.html, '..', 'favicon.svg'),
        }),
        new webpack.ProgressPlugin(),
        new MiniCssExtractPlugin({
            filename: 'css/[name].[contenthash:8].css',
            chunkFilename: 'css/[name].[contenthash:8].css',
        }),
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),
        new webpack.DefinePlugin({
            'process.env.DATA_BACKEND': JSON.stringify(
                process.env.DATA_BACKEND || 'firebase'
            ),
            'process.env.APPWRITE_ENDPOINT': JSON.stringify(
                process.env.APPWRITE_ENDPOINT || ''
            ),
            'process.env.APPWRITE_PROJECT_ID': JSON.stringify(
                process.env.APPWRITE_PROJECT_ID || ''
            ),
            'process.env.APPWRITE_DATABASE_ID': JSON.stringify(
                process.env.APPWRITE_DATABASE_ID || 'print_shop'
            ),
        }),
    ]
}