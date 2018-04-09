package org.kurento.tutorial.groupcall.selenium;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.remote.DesiredCapabilities;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class TestCase {

	
	Logger logger = LoggerFactory.getLogger(this.getClass());
	
	private WebDriver driver;
	
	public void openURL(String url) throws InterruptedException {
		System.setProperty("webdriver.chrome.driver", "/Users/vijaykrishna/Downloads/chromedriver");
		logger.info("driver found");
		for(int i=0;i<2;i++){
			logger.info("Iteration : "+i);
			try {
				ChromeOptions options = new ChromeOptions();
				options.addArguments("use-fake-ui-for-media-stream");
				options.addArguments("use-fake-device-for-media-stream");
				DesiredCapabilities capabilities = DesiredCapabilities.chrome();
				capabilities.setCapability(ChromeOptions.CAPABILITY, options);
				driver = new ChromeDriver(capabilities);
//				driver.manage().timeouts().implicitlyWait(60, TimeUnit.SECONDS);
//				driver.manage().window().maximize();
				driver.get("https://ptp.mroads.com:7443/ionic?room=123&q=hd&fr=10&codec=VP9");
				Thread.sleep(30000);
			}
			catch (Exception e) {
				logger.error("Exception",e);
			}
			finally{
				driver.close();
				Thread.sleep(2000);
			}
		}
		driver.quit();
	}
	
	public void closeBrowser() throws InterruptedException {
		try {
			driver.close();
		}
		catch(Exception e) {
			logger.error("error",e);
		}
		try {
			driver.quit();
		}
		catch(Exception e) {
			logger.error("error",e);
		}
	}
}
