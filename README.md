Clone the project.

    git clone https://github.com/WillieMaddox/osmsat-client.git

Install the project dependencies.

    cd osmsat-client
    npm install

Create a bundle for the browser.

    npm run build-dev

Open `index.html` to see the result.

    open index.html
    
For Yolo Model (tfjs pure js version must get model from url so we must run a server to serve the model)

    cd best_web_model
    npx http-server -c1 --cors .