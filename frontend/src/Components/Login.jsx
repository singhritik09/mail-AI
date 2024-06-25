import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
// import Cookies from "js-cookie";
import { GoogleLogin } from '@react-oauth/google';
import { GoogleOAuthProvider } from '@react-oauth/google';

export default function Login() {
    const navigate = useNavigate();
    const clientId = "862630718442-45e0nspmivb33o8m4hlidp5qaffcs6bb.apps.googleusercontent.com"
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const handleSuccess = (i) => {
        console.log(("User logged in", i))
        setIsLoggedIn(true);
    }

    const handleError = () => {
        console.log("Error");
    }

    useEffect(() => {
        if (isLoggedIn) {
            navigate("/");
        }
    }, [isLoggedIn, navigate]);

    return (
        <div className="root">
            <GoogleOAuthProvider clientId={clientId}>
                <GoogleLogin
                    onSuccess={(i) => handleSuccess(i)}
                    onError={handleError}
                />
            </GoogleOAuthProvider>;

        </div>
    );
}