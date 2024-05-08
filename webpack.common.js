const path = require('path');
const webpack = require('webpack');
const Dotenv = require('dotenv-webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const APP_SOURCE = path.join(__dirname, "src");

module.exports = {
    // entry: {
    //     index: './src/index.js',
    // },
    output: {
        // path: path.resolve(__dirname, 'dist'),
        publicPath: "",
        clean: true
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                include: APP_SOURCE,
                use: 'babel-loader',
            },
            { test: /\.html$/i, loader: 'html-loader' },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            filename: 'index.html',
            template: './src/index.html',
            // template: indexHtml,
            publicPath: '',
            inject: 'body',
            // hash: true
        }),
    ],
};
