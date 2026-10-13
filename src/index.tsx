import { Buffer } from 'buffer';
import { render } from "react-dom";
import App from "./app/App";
import { HashRouter } from "react-router-dom";
import "./app/styles/index.scss";
import { Provider } from "react-redux";
import store from "./app/providers/StoreProvider/Store";

// chartsheet / JSZip ожидают Node Buffer в браузере
(globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;


render(
    <Provider store={store}>
        <HashRouter>
            <App />
        </HashRouter>
    </Provider>,
    document.getElementById("root")
);
