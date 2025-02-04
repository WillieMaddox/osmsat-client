const Dotenv = require("dotenv-webpack");
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');




module.exports = merge([
    common,
    {
        mode: 'development',
        output: {
            filename: '[name].bundle.js', // DEV
        },
        module: {
            rules: [
                {
                    test: /\.css$/i,
                    use: ["style-loader", "css-loader"],
                },
            ]
        },
        plugins: [
            new Dotenv({
                path: `./.env.development`
            }),
        ],
        devtool: 'inline-source-map',
        devServer: {
            hot: true,
            compress: true,
            static: './dist',
            proxy: {
                '/api': 'http://localhost:3050'
            },
            port: 3050,
            // writeToDisk: true,
            devMiddleware: {
                index: false,
                // mimeTypes: { phtml: 'text/html' },
                publicPath: './dist',
                serverSideRender: true,
                writeToDisk: true,
            },
        },
        optimization: {
            runtimeChunk: true,
        },
    }
]);
