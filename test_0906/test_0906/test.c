#define _CRT_SECURE_NO_WARNINGS
//#include<stdio.h>
//int main()
//{
//    int a = 0;
//    scanf("%d", &a);
//    if (a % 2 == 1)
//        printf("%d为奇数\n", a);
//    else
//        printf("%d为偶数\n", a);
//    return 0;
//}


//#include<stdio.h>
//int main()
//{
//	int a = 1;
//	while (a < 101)
//	{
//		if (a % 2 == 1)
//		{
//			printf("%d	", a);	
//        	}
//		a++;
//	}
//	return 0;
//}


//输出星期一到星期日
//#include<stdio.h>
//int main()
//{
//	int num = 0;
//	scanf("%d", &num);
//	if (1 == num)
//		printf("星期一");
//	else if(2 == num)
//		printf("星期二");
//	else if (3 == num)
//		printf("星期三");
//	else if (4 == num)
//		printf("星期四");
//	else if (5 == num)
//		printf("星期五");
//	else if (6 == num)
//		printf("星期六");
//	else
//		printf("星期日");
//	return 0;
//}


//工作日与周末的判断
//#include<stdio.h>
//int main()
//{
//	int day = 0;
//	int a = 1;
//	scanf("%d", &day);
//	while (1 == a)
//	{
//		if (day >= 1 && day <= 5)
//		{
//			printf("weekday");
//			break;
//		}
//		else if (6 == day || 7 == day)
//		{
//			printf("weekend");
//			break;
//		}
//		else
//		{
//			printf("err");
//		}
//		return 0;
//	}
//}


//switch语句尝试
//#include<stdio.h>
//int main()
//{
//	int day = 0;
//	scanf("%d", &day);
//	switch (day)
//	{
//	case 1:
//	case 2:
//	case 3:
//	case 4:
//	case 5:
//		printf("weekday");
//		break;
//	case 6:
//	case 7:
//		printf("weekend");
//		break;
//	}
//	return 0;
//}



//打印1-10
//#include<stdio.h>
//int main()
//{
//	int a = 1;
//	while (a < 11)
//	{
//		printf("%d\n", a);
//		a++;
//	}
//	return 0;
//}


//输入出生日期
//#include<stdio.h>
//int main()
//{
//	int year = 0;
//	int month = 0;
//	int day = 0;
//	scanf("%4d%2d%2d", &year, &month, &day);
//	printf("year = %04d\n", year);
//	printf("month = %02d\n", month);
//	printf("day = %02d\n", day);
//	return 0;
//}


//学生信息输入输出
//#include<stdio.h>
//int main()
//{
//	int ID = 0;
//	int Chi = 0;
//	int Mat = 0;
//	int Eng = 0;
//	scanf("%d,%d,%d,%d", &ID, &Chi, &Mat, &Eng);
//	printf("The each subject score of No.%d is %d,%d,%d", ID, Chi, Mat, Eng);
//	return 0;
//}
//比较四个数输出最大数
#include<stdio.h>
int bijiao(int a, int b)
{
	if (a >= b)
		return a;
	else
		return b;
}

int main()
{
	int a, b, c, d = 0;


	return 0;
}