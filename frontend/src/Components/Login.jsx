import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
// import Cookies from "js-cookie";
import { GoogleLogin } from '@react-oauth/google';
import { GoogleOAuthProvider } from '@react-oauth/google';

export default function Login() {
    const navigate = useNavigate();
    const clientId = "862630718442-45e0nspmivb33o8m4hlidp5qaffcs6bb.apps.googleusercontent.com"
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const fetchUserInfo = () => {
        // Use Google's API to fetch user info
        window.gapi.client.load('oauth2', 'v2', () => {
            window.gapi.client.oauth2.userinfo.get().execute((userInfo) => {
                console.log("User info", userInfo);

                const userEmail = userInfo.email || ''; // Assuming you get email from userInfo
                setIsLoggedIn(true);
            });
        });
    }

    const handleSuccess = (i) => {
        console.log(("User logged in", i))
        fetchUserInfo();
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