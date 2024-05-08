const glob = require('glob');
const path = require("path");
// const webpack = require("webpack");
const Dotenv = require('dotenv-webpack');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const PurgeCSSPlugin = require("purgecss-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
// const TerserPlugin = require("terser-webpack-plugin");

const ALL_FILES = glob.sync(path.join(__dirname, "src/*.js"));
const APP_SOURCE = path.join(__dirname, "src");

exports.page = ({ title } = {}) => ({
  plugins: [
    new HtmlWebpackPlugin({
      title: title,
      filename: 'index.html',
      template: './src/index.html',
      // template: indexHtml,
      publicPath: '',
      inject: 'body',
      // hash: true
    }),
  ],
});

exports.minifyCSS = ({ options }) => ({
  optimization: {
    minimizer: [
      new CssMinimizerPlugin({ minimizerOptions: options }),
    ],
  },
});

// exports.minifyJavaScript = () => ({
//   optimization: {
//     minimizer: [new TerserPlugin()],
//   },
// });

exports.clean = () => ({
  output: {
    clean: true,
  },
});

exports.loadJavaScript = () => ({
  module: {
    rules: [
      {
        test: /\.js$/,
        include: APP_SOURCE, // Consider extracting as a parameter
        use: "babel-loader",
      },
    ],
  },
});

exports.eliminateUnusedCSS = () => ({
  plugins: [
    new PurgeCSSPlugin({
      paths: ALL_FILES, // Consider extracting as a parameter
      extractors: [
        {
          extractor: (content) =>
              content.match(/[^<>"'`\s]*[^<>"'`\s:]/g) || [],
          extensions: ["html"],
        },
      ],
    }),
  ],
});

exports.extractCSS = ({ options = {}, loaders = [] } = {}) => {
  return {
    module: {
      rules: [
        {
          test: /\.css$/i,
          use: [
            { loader: MiniCssExtractPlugin.loader, options },
            "css-loader",
          ].concat(loaders),
          sideEffects: true,
        },
      ],
    },
    plugins: [
      new MiniCssExtractPlugin({
        // filename: "[name].css",
        filename: "[name].[contenthash].css",
        chunkFilename: "[id].[contenthash].css"
      }),
    ],
  };
};

exports.devServer = () => ({
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
      publicPath: './dist',
      serverSideRender: true,
      writeToDisk: true,
    },
  },
});

exports.tailwind = () => ({
  loader: "postcss-loader",
  options: {
    postcssOptions: { plugins: [require("tailwindcss")()] },
  },
});

exports.autoprefix = () => ({
  loader: "postcss-loader",
  options: {
    postcssOptions: { plugins: [require("autoprefixer")()] },
  },
});

exports.generateSourceMaps = ({ type }) => ({
  devtool: type,
});

exports.env = ({ mode }) => ({
  plugins: [
    new Dotenv({
      path: `./.env.${mode}`
    }),
  ]
});

exports.setExtraPlugins = pluginsArray => ({
  plugins: pluginsArray
});