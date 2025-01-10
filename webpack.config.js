const path = require("path");
const webpack = require("webpack");
const { merge } = require("webpack-merge");
const { mode } = require("webpack-nano/argv");
const parts = require("./webpack.parts");

const cssLoaders = [parts.autoprefix()]; //, parts.tailwind()];

const commonConfig = merge([
  {
      output: {
      // Tweak this to match your GitHub project name
      publicPath: "auto",
    },
  },
  // { entry: ["./src"] },
  parts.ignorenodemodules(),
  parts.page({ title: "OSMSAT" }),
  parts.clean(),
  parts.loadJavaScript(),
]);

const productionConfig = merge([
  {
    output: {
      filename: "[name].[contenthash].js",
      chunkFilename: "[name].[contenthash].js",
    },
    // recordsPath: path.join(__dirname, "records.json"),
  },
  parts.extractCSS({ loaders: cssLoaders }),
  // parts.minifyJavaScript(),
  parts.minifyCSS({
    options: {
      preset: ["default"],
    },
  }),
  // parts.eliminateUnusedCSS(),
  parts.generateSourceMaps({ type: "source-map" }),
  {
    optimization: {
      runtimeChunk: {
        name: "runtime",
      },
    },
  },
]);

const developmentConfig = merge([
  {
    output: {
      filename: '[name].bundle.js',
    },
    module: {
      rules: [
        {
          test: /\.css$/i,
          use: ["style-loader", "css-loader"],
        },
      ]
    },
  },
  parts.generateSourceMaps({ type: "inline-source-map" }),
  parts.devServer(),
]);

const getConfig = (mode) => {
  switch (mode) {
    case "production":
      return merge(commonConfig, productionConfig, parts.env({ mode }), { mode });
    case "development":
      return merge(commonConfig, developmentConfig, parts.env({ mode }), { mode });
    default:
      throw new Error(`Trying to use an unknown mode, ${mode}`);
  }
};

module.exports = getConfig(mode);