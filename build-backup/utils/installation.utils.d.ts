import { InstallPackageOptions } from '../common.types';
declare const InstallationUtils: {
    getInstallPath(packageName: string): string;
    preparePath(packageName: string): Promise<string>;
    installPackage(packageString: string, installPath: string, installOptions: InstallPackageOptions): Promise<void>;
    cleanupPath(installPath: string): Promise<void>;
};
export default InstallationUtils;
