const Dotenv = require("dotenv-webpack");
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
// const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const parts = require("./webpack.parts");
const cssLoaders = [parts.autoprefix()];

module.exports = merge([
    common,
    parts.extractCSS({ loaders: cssLoaders }),
    // parts.eliminateUnusedCSS(),
    parts.minifyCSS({ options: { preset: ["default"]}}),
    {
        mode: 'production',
        output: {
            filename: '[name].[contenthash].js', // PROD
            chunkFilename: "[name].[contenthash].js",
        },
        plugins: [
            new Dotenv({
                path: `./.env.production`
            }),
        ],
        devtool: 'source-map',
        optimization: {
            runtimeChunk: 'single',
        },
    }]
);
