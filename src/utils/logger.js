/**
 * Crixen Secure Logger
 * 
 * Centralized logging utility to managing verbosity and sanitizing sensitive data.
 * Attached to window.CrixenLogger for global access in content scripts.
 */

(function () {
    'use strict';

    // Force debug mode false for production/release, true for dev
    const DEBUG_MODE = false; // TODO: Set to false for production release

    const PREFIX = '[Crixen]';

    class Logger {
        static info(message, ...args) {
            if (!DEBUG_MODE) return;
            console.log(`${PREFIX} [INFO] ${message}`, ...this._sanitize(args));
        }

        static warn(message, ...args) {
            // Warnings are useful in production too, but we can silence them if needed
            console.warn(`${PREFIX} [WARN] ${message}`, ...this._sanitize(args));
        }

        static error(message, ...args) {
            // Errors should always be visible, but sanitized
            console.error(`${PREFIX} [ERROR] ${message}`, ...this._sanitize(args));
        }

        static debug(message, ...args) {
            if (!DEBUG_MODE) return;
            console.debug(`${PREFIX} [DEBUG] ${message}`, ...this._sanitize(args));
        }

        static group(label) {
            if (!DEBUG_MODE) return;
            console.group(`${PREFIX} ${label}`);
        }

        static groupEnd() {
            if (!DEBUG_MODE) return;
            console.groupEnd();
        }

        /**
         * Prevents logging of potentially sensitive keys or deeply nested objects that might choke the console.
         */
        static _sanitize(args) {
            return args.map(arg => {
                if (typeof arg === 'object' && arg !== null) {
                    // If it's an error object, return it as is (browsers handle Error objects well)
                    if (arg instanceof Error) return arg;

                    // Shallow copy to avoid mutating original
                    try {
                        const safeArg = { ...arg };
                        const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth'];

                        Object.keys(safeArg).forEach(key => {
                            if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
                                safeArg[key] = '***REDACTED***';
                            }
                        });

                        return safeArg;
                    } catch (e) {
                        return '[Unserializable Object]';
                    }
                }
                return arg;
            });
        }
    }

    // Expose globally
    window.CrixenLogger = Logger;

})();
